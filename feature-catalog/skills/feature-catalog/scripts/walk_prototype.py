#!/usr/bin/env python3
"""Walk a Claude Code design prototype HTML in headless Chrome and capture
every reachable screen (text outline + screenshot) for spec writing.

Stdlib only (hand-rolled WebSocket client for the Chrome DevTools Protocol),
Python >= 3.9. Chrome is found via $CHROME_PATH, the default macOS app path,
or PATH.

Usage:
    walk_prototype.py <prototype.html> --out DIR [options]

Options:
    --inventory        Capture ONLY the initial screen + its clickables, then exit.
                       Use this first to map the prototype / pick a --nav path.
    --nav "A,B"        Click path (visible labels) to walk INTO after each load;
                       only screens under it are explored. Labels containing commas:
                       pass a JSON array instead: --nav '["A","B, with comma"]'
    --only "X,Y"       Expand ONLY these labels from the entry screen (exact labels
                       as printed by --inventory). Use when the requested scope is a
                       visual group (e.g. a sidebar section) rather than a click path.
                       JSON array form supported, same as --nav.
    --max-screens N    Stop after capturing N distinct screens (default 40).
    --depth N          Max click-path length beyond the --nav prefix (default 3).
    --per-screen N     Max clickables expanded per screen (default 25).
    --timeout N        Per-screen settle timeout seconds (default 15).

Output (in --out DIR):
    NNN_<slug>.png     screenshot of each distinct screen
    NNN_<slug>.txt     text outline (headings, fields, buttons, tables, full text)
    index.json         [{id, path, png, txt, n_clickables, truncated_expand}]
    skipped.json       clickables not expanded (risky labels / caps hit)

Screens are deduplicated by a signature of their normalized text. Each path is
replayed from a fresh page load, so state never compounds across captures.
"""
import argparse
import base64
import hashlib
import json
import os
import re
import shutil
import socket
import struct
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
from pathlib import Path

RISKY_LABEL = re.compile(r"download|export|print|browse|choose file|log ?out|sign ?out", re.I)


# ---------------------------------------------------------------- WebSocket
class WS:
    """Minimal RFC6455 client over a plain socket (localhost CDP only)."""

    def __init__(self, url, timeout=60):
        m = re.match(r"ws://([^:/]+):(\d+)(/.*)", url)
        if not m:
            raise ValueError("bad ws url: " + url)
        host, port, path = m.group(1), int(m.group(2)), m.group(3)
        self.sock = socket.create_connection((host, port), timeout=timeout)
        key = base64.b64encode(os.urandom(16)).decode()
        req = (f"GET {path} HTTP/1.1\r\nHost: {host}:{port}\r\n"
               "Upgrade: websocket\r\nConnection: Upgrade\r\n"
               f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n")
        self.sock.sendall(req.encode())
        resp = b""
        while b"\r\n\r\n" not in resp:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise ConnectionError("ws handshake EOF")
            resp += chunk
        if b" 101 " not in resp.split(b"\r\n", 1)[0]:
            raise ConnectionError("ws handshake failed: " + resp[:200].decode("ascii", "replace"))

    def _read_exact(self, n):
        buf = b""
        while len(buf) < n:
            chunk = self.sock.recv(n - len(buf))
            if not chunk:
                raise ConnectionError("ws closed")
            buf += chunk
        return buf

    def send(self, text):
        payload = text.encode()
        header = bytearray([0x81])  # FIN + text opcode
        mask = os.urandom(4)
        n = len(payload)
        if n < 126:
            header.append(0x80 | n)
        elif n < 1 << 16:
            header.append(0x80 | 126)
            header += struct.pack(">H", n)
        else:
            header.append(0x80 | 127)
            header += struct.pack(">Q", n)
        header += mask
        self.sock.sendall(bytes(header) + bytes(b ^ mask[i % 4] for i, b in enumerate(payload)))

    def recv(self):
        """Return one complete text message (reassembles fragments)."""
        msg = b""
        while True:
            b1, b2 = self._read_exact(2)
            fin, opcode = b1 & 0x80, b1 & 0x0F
            n = b2 & 0x7F
            if n == 126:
                n = struct.unpack(">H", self._read_exact(2))[0]
            elif n == 127:
                n = struct.unpack(">Q", self._read_exact(8))[0]
            data = self._read_exact(n)
            if opcode == 0x9:  # ping -> pong
                self.sock.sendall(bytes([0x8A, 0x80]) + os.urandom(4))
                continue
            if opcode == 0x8:
                raise ConnectionError("ws closed by peer")
            msg += data
            if fin:
                return msg.decode()

    def close(self):
        try:
            self.sock.close()
        except OSError:
            pass


# ---------------------------------------------------------------- CDP client
class CDP:
    def __init__(self, ws_url):
        self.ws = WS(ws_url)
        self.next_id = 1

    def cmd(self, method, **params):
        mid = self.next_id
        self.next_id += 1
        self.ws.send(json.dumps({"id": mid, "method": method, "params": params}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get("id") == mid:
                if "error" in msg:
                    raise RuntimeError(f"{method}: {msg['error']}")
                return msg.get("result", {})
            self._event(msg)

    def _event(self, msg):
        m = msg.get("method", "")
        if m == "Page.javascriptDialogOpening":  # never hang on alert/confirm
            try:
                self.ws.send(json.dumps({"id": self.next_id, "method":
                    "Page.handleJavaScriptDialog", "params": {"accept": False}}))
                self.next_id += 1
            except ConnectionError:
                pass

    def js(self, expr):
        r = self.cmd("Runtime.evaluate", expression=expr, returnByValue=True)
        return r.get("result", {}).get("value")


# ---------------------------------------------------------------- JS helpers
JS_HELPERS = r"""
window.__walk = (() => {
  const visible = el => {
    if (!el || el.closest('[aria-hidden="true"]')) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1 &&
           getComputedStyle(el).visibility !== 'hidden';
  };
  const labelOf = el => ((el.innerText || el.getAttribute('aria-label') ||
    el.title || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 80));
  const candidates = () => {
    const els = [...document.querySelectorAll(
      'a,button,[role="button"],[role="tab"],[role="menuitem"],[role="link"],[onclick]')]
      .filter(visible);
    const out = [], counts = {};
    for (const el of els) {
      const label = labelOf(el);
      if (!label) continue;
      const n = counts[label] = (counts[label] ?? -1) + 1;
      out.push({label, n});
    }
    return out;
  };
  const find = (label, n) => {
    let i = -1;
    for (const el of [...document.querySelectorAll(
      'a,button,[role="button"],[role="tab"],[role="menuitem"],[role="link"],[onclick]')]
      .filter(visible)) {
      if (labelOf(el) === label && ++i === n) return el;
    }
    return null;
  };
  const click = (label, n) => {
    const el = find(label, n);
    if (!el) return false;
    el.scrollIntoView({block: 'center'});
    el.click();
    return true;
  };
  const fieldLabel = el => {
    if (el.id) { const l = document.querySelector(`label[for="${el.id}"]`);
                 if (l) return l.innerText.trim(); }
    const p = el.closest('label');
    return (p ? p.innerText.trim() : '') || el.placeholder ||
           el.getAttribute('aria-label') || el.name || '';
  };
  const outline = () => {
    const L = [];
    L.push('TITLE: ' + document.title);
    for (const h of [...document.querySelectorAll('h1,h2,h3,h4')].filter(visible))
      L.push(`${h.tagName}: ${h.innerText.trim().replace(/\s+/g, ' ').slice(0, 120)}`);
    for (const f of [...document.querySelectorAll('input,select,textarea')].filter(visible)) {
      let extra = '';
      if (f.tagName === 'SELECT') extra = ' options=[' +
        [...f.options].slice(0, 12).map(o => o.text.trim()).join('|') + ']';
      L.push(`FIELD: ${fieldLabel(f).slice(0, 60)} (${f.tagName.toLowerCase()}` +
        `${f.type ? ':' + f.type : ''}${f.required ? ', required' : ''}` +
        `${f.disabled ? ', disabled' : ''})${extra}`);
    }
    for (const b of [...document.querySelectorAll('button,[role="button"]')].filter(visible)) {
      const t = (b.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 60);
      if (t) L.push(`BUTTON: ${t}${b.disabled ? ' (disabled)' : ''}`);
    }
    for (const t of [...document.querySelectorAll('table')].filter(visible).slice(0, 6)) {
      const heads = [...t.querySelectorAll('th')].map(th => th.innerText.trim()).join(' | ');
      const rows = t.querySelectorAll('tbody tr, tr');
      L.push(`TABLE (${rows.length} rows): ${heads.slice(0, 300)}`);
      for (const r of [...rows].slice(0, 3))
        L.push('  ROW: ' + [...r.querySelectorAll('td')]
          .map(td => td.innerText.trim().replace(/\s+/g, ' ')).join(' | ').slice(0, 300));
    }
    L.push('--- FULL TEXT ---');
    L.push((document.body.innerText || '').slice(0, 8000));
    return L.join('\n').slice(0, 16000);
  };
  const signature = () => {
    const t = (document.body.innerText || '').replace(/\s+/g, ' ').trim();
    let h = 0;
    for (let i = 0; i < t.length; i++) { h = (h * 31 + t.charCodeAt(i)) | 0; }
    return h + ':' + t.length;
  };
  const settled = () => {
    const l = document.getElementById('__bundler_loading');
    return document.readyState === 'complete' && !l &&
           (document.body.innerText || '').trim().length > 0;
  };
  return {candidates, click, outline, signature, settled};
})(); true
"""


# ---------------------------------------------------------------- Chrome
def find_chrome():
    for p in (os.environ.get("CHROME_PATH"),
              "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
              shutil.which("google-chrome"), shutil.which("chromium")):
        if p and Path(p).exists():
            return p
    sys.exit("error: Chrome not found. Set CHROME_PATH or install Google Chrome. "
             "Fall back to static extraction (extract_bundle.py) and mark the "
             "spec 'unverified - generated without rendering'.")


def launch_chrome(chrome):
    profile = tempfile.mkdtemp(prefix="walkproto-")
    proc = subprocess.Popen(
        [chrome, "--headless", "--disable-gpu", "--no-first-run",
         "--no-default-browser-check", "--remote-debugging-port=0",
         "--window-size=1440,900", f"--user-data-dir={profile}", "about:blank"],
        stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    port = [None]

    def read_stderr():
        for line in proc.stderr:
            m = re.search(rb"DevTools listening on ws://[^:]+:(\d+)/", line)
            if m:
                port[0] = int(m.group(1))
        # keep draining so the pipe never blocks chrome

    t = threading.Thread(target=read_stderr, daemon=True)
    t.start()
    deadline = time.time() + 20
    while port[0] is None and time.time() < deadline and proc.poll() is None:
        time.sleep(0.1)
    if port[0] is None:
        proc.kill()
        sys.exit("error: Chrome did not expose a DevTools port within 20s")
    return proc, port[0], profile


def page_ws_url(port):
    with urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list", timeout=10) as r:
        targets = json.load(r)
    for t in targets:
        if t.get("type") == "page":
            return t["webSocketDebuggerUrl"]
    sys.exit("error: no page target in Chrome")


# ---------------------------------------------------------------- Walker
def slugify(text, fallback):
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60]
    return s or fallback


def parse_labels(arg):
    """Comma-separated labels, or a JSON array for labels that contain commas."""
    arg = arg.strip()
    if arg.startswith("["):
        return [str(x) for x in json.loads(arg)]
    return [l.strip() for l in arg.split(",") if l.strip()]


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


def seed_existing(out, walker):
    """When appending, pre-load prior screens so new screen ids continue and the
    final index.json merges old + new. Returns the number of pre-existing screens."""
    idx = out / "index.json"
    if not idx.exists():
        return 0
    data = json.loads(idx.read_text())
    walker.screens = data.get("screens", [])
    walker.aliases = data.get("aliases", [])
    walker.seen = {s["sig"]: s["id"] for s in walker.screens if "sig" in s}
    return len(walker.screens)


class Walker:
    def __init__(self, cdp, file_url, out, args):
        self.cdp, self.file_url, self.out, self.args = cdp, file_url, out, args
        self.seen = {}      # signature -> screen id
        self.screens = []   # index.json entries
        self.skipped = []
        self.clicks_spent = 0
        self.seed_count = 0
        self.aliases = []   # click paths that landed on already-captured screens
        self.chrome_labels = set()  # global chrome; out of scope for --nav walks

    def _at_cap(self):
        """True when this run has captured its per-walk budget of NEW screens
        (seeded screens from a prior --append walk do not count)."""
        return (len(self.screens) - self.seed_count) >= self.args.max_screens

    def load(self, path):
        """Fresh page load, then replay click path. Returns False if replay broke."""
        self.cdp.cmd("Page.navigate", url=self.file_url)
        self._settle()
        self.cdp.js(JS_HELPERS)
        for label, n in path:
            if not self.cdp.js(f"window.__walk.click({json.dumps(label)}, {n})"):
                return False
            self.clicks_spent += 1
            self._settle(short=True)
        return True

    def _settle(self, short=False):
        deadline = time.time() + (5 if short else self.args.timeout)
        last, stable_since = None, None
        while time.time() < deadline:
            try:
                ok = self.cdp.js("window.__walk ? window.__walk.settled() : "
                                 "(document.readyState === 'complete')")
                sig = self.cdp.js("window.__walk && window.__walk.signature()") if ok else None
            except RuntimeError:
                ok, sig = False, None
            if ok and sig is not None:
                if sig == last:
                    if stable_since and time.time() - stable_since >= 0.4:
                        return
                    stable_since = stable_since or time.time()
                else:
                    last, stable_since = sig, None
            time.sleep(0.25)
        # proceed anyway; outline will show whatever rendered

    def capture(self, path):
        sig = self.cdp.js("window.__walk.signature()")
        if sig in self.seen:
            if path:  # visible trace: this click path landed on a known screen
                self.aliases.append({"path": [p[0] for p in path],
                                     "same_as": self.seen[sig]})
            return self.seen[sig], False
        sid = len(self.screens)
        outline = self.cdp.js("window.__walk.outline()") or ""
        # Name by content heading (what the screen IS), not by what was clicked:
        # nav defaults make path labels misleading (e.g. "Settings" landing on
        # its first sub-page).
        title = next((l[4:].strip() for l in outline.splitlines()
                      if l.startswith(("H1: ", "H2: "))), "")
        name = f"{sid:03d}_" + slugify(title or " ".join(p[0] for p in path[-2:]), "screen")
        shot = self.cdp.cmd("Page.captureScreenshot", format="png")
        (self.out / f"{name}.png").write_bytes(base64.b64decode(shot["data"]))
        (self.out / f"{name}.txt").write_text(
            "PATH: " + (" > ".join(p[0] for p in path) or "(initial)") + "\n" + outline)
        cands = self.cdp.js("window.__walk.candidates()") or []
        self.screens.append({"id": sid, "title": title,
                             "path": [p[0] for p in path],
                             "png": f"{name}.png", "txt": f"{name}.txt",
                             "n_clickables": len(cands), "truncated_expand": False,
                             "sig": sig})
        self.seen[sig] = sid
        print(f"  [{sid:03d}] {' > '.join(p[0] for p in path) or '(initial)'} "
              f"({len(cands)} clickables)")
        return sid, True

    def candidates(self, path, only=None, parent_labels=None):
        """Filter expansion candidates. Order matters: semantic filters first,
        the per-screen cap last, so the cap never starves wanted labels."""
        cands = self.cdp.js("window.__walk.candidates()") or []
        all_labels = {c["label"] for c in cands}
        keep, screen_id = [], len(self.screens) - 1

        def skip(label, why):
            self.skipped.append({"path": [p[0] for p in path], "label": label,
                                 "why": why})

        for c in cands:
            label = c["label"]
            if RISKY_LABEL.search(label):
                skip(label, "risky label")
            elif label in self.chrome_labels:
                skip(label, "global chrome (outside --nav scope)")
            elif only is not None and label not in only:
                skip(label, "not in --only")
            elif parent_labels is not None and label in parent_labels:
                skip(label, "present on parent screen (walked at its own level)")
            else:
                keep.append((label, c["n"]))
        if len(keep) > self.args.per_screen:
            for label, n in keep[self.args.per_screen:]:
                skip(label, "per-screen cap")
            if 0 <= screen_id < len(self.screens):
                self.screens[screen_id]["truncated_expand"] = True
            keep = keep[: self.args.per_screen]
        return keep, all_labels

    def run(self, prefix):
        if prefix:
            # Scoped walk: navigate to the scope in one pass, accumulating every
            # label visible BEFORE the final step. That set is persistent nav
            # (global chrome, intermediate sidebars) — expanding any of it would
            # leave the scope.
            self.cdp.cmd("Page.navigate", url=self.file_url)
            self._settle()
            self.cdp.js(JS_HELPERS)
            for label, n in prefix:
                self.chrome_labels |= {c["label"] for c in
                                       (self.cdp.js("window.__walk.candidates()") or [])}
                if not self.cdp.js(f"window.__walk.click({json.dumps(label)}, {n})"):
                    sys.exit(f"error: --nav path not clickable: "
                             f"{' > '.join(p[0] for p in prefix)}. Run --inventory "
                             "and pick labels exactly as listed.")
                self.clicks_spent += 1
                self._settle(short=True)
        else:
            self.load(prefix)
        self.cdp.cmd("Page.setInterceptFileChooserDialog", enabled=True)
        sid, _ = self.capture(prefix)
        if self.args.inventory:
            cands = self.cdp.js("window.__walk.candidates()") or []
            (self.out / "inventory.json").write_text(json.dumps(cands, indent=2))
            print(f"inventory: {len(cands)} clickables on initial screen "
                  f"-> {self.out}/inventory.json")
            return
        wanted = set(parse_labels(self.args.only)) if self.args.only else None
        root_cands, root_labels = self.candidates(prefix, only=wanted)
        if wanted:
            unmatched = wanted - {label for label, _ in root_cands}
            if unmatched:
                sys.exit(f"error: --only labels not found on entry screen: "
                         f"{sorted(unmatched)}. Copy labels exactly from --inventory.")
        queue = [(prefix, root_cands, root_labels)]
        while queue and not self._at_cap():
            path, cands, labels_here = queue.pop(0)
            for label, n in cands:
                if self._at_cap():
                    self.skipped.append({"path": [p[0] for p in path], "label": label,
                                         "why": "max-screens cap"})
                    continue
                new_path = path + [(label, n)]
                if not self.load(new_path):
                    self.skipped.append({"path": [p[0] for p in path], "label": label,
                                         "why": "replay failed"})
                    continue
                _, fresh = self.capture(new_path)
                if fresh and len(new_path) - len(prefix) < self.args.depth:
                    child_cands, child_labels = self.candidates(
                        new_path, parent_labels=labels_here)
                    queue.append((new_path, child_cands, child_labels))


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("html")
    ap.add_argument("--out", required=True)
    ap.add_argument("--inventory", action="store_true")
    ap.add_argument("--append", action="store_true")
    ap.add_argument("--nav", default="")
    ap.add_argument("--only", default="")
    ap.add_argument("--max-screens", type=int, default=40)
    ap.add_argument("--depth", type=int, default=3)
    ap.add_argument("--per-screen", type=int, default=25)
    ap.add_argument("--timeout", type=int, default=15)
    args = ap.parse_args()

    html = Path(args.html).resolve()
    if not html.is_file():
        sys.exit(f"error: not a file: {html}")
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    prefix = [(label, 0) for label in parse_labels(args.nav)]

    proc, port, profile = launch_chrome(find_chrome())
    try:
        cdp = CDP(page_ws_url(port))
        cdp.cmd("Page.enable")
        cdp.cmd("Emulation.setDeviceMetricsOverride", width=1440, height=900,
                deviceScaleFactor=1, mobile=False)
        walker = Walker(cdp, html.as_uri(), out, args)
        if args.append:
            walker.seed_count = seed_existing(out, walker)
        t0 = time.time()
        walker.run(prefix)
        (out / "index.json").write_text(json.dumps(
            {"screens": walker.screens, "aliases": walker.aliases}, indent=2))
        (out / "skipped.json").write_text(json.dumps(walker.skipped, indent=2))
        print(f"done: {len(walker.screens)} distinct screens, "
              f"{len(walker.skipped)} skipped clickables, "
              f"{walker.clicks_spent} clicks, {time.time() - t0:.0f}s -> {out}")
    finally:
        proc.kill()
        shutil.rmtree(profile, ignore_errors=True)


if __name__ == "__main__":
    main()
